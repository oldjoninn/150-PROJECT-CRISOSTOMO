# nolint start

# simplex.R - Luzon Grid Dispatch: own simplex implementation (no optimization packages)
# Method (lab handout): matrix -> transpose -> dual -> simplex tableau.
EPS <- 1e-9
GROUPS <- c("Coal", "Natural Gas", "Geothermal", "Hydro", "Oil-based", "Solar", "Wind")
CAP  <- c(7000, 3300, 800, 2500, 1500, 2500, 400)
EM   <- c(0.95, 0.40, 0.10, 0, 0.75, 0, 0)
B1   <- c(3800, 6500, 1500, 300, 14000, 40, 60)
FUEL <- c(TRUE, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE)
HEAT <- c(1.00, 1.01, 1.03, 1.05, 1.04, 1.02)
DEM  <- c(6300, 8600, 11800, 12300, 14000, 10600)
A_SOLAR <- c(0, 0.10, 0.60, 0.55, 0.08, 0)
A_WIND  <- c(0.35, 0.30, 0.25, 0.25, 0.30, 0.35)
H <- 4; RAMP <- 1500; WATER <- 8000; COAL_MIN <- 0.40

unit_cost <- function(g, t) if (FUEL[g]) round(B1[g] * HEAT[t]) else B1[g]
avail <- function(g, t) switch(GROUPS[g], Solar = A_SOLAR[t], Wind = A_WIND[t], 1)

# Steps 1-2: constraints in '>=' form (rows) + objective h*c. Unselected groups are removed.
build_lp <- function(sel, co2cap = NULL) {
  gi <- which(GROUPS %in% sel)
  vars <- expand.grid(t = 1:6, g = gi)          # group by group, B1..B6
  n <- nrow(vars)
  ix <- function(g, t) which(vars$g == g & vars$t == t)
  A <- list(); b <- numeric(0); lab <- character(0)
  add <- function(cols, vals, rhs, name) {
    r <- numeric(n); r[cols] <- vals
    A[[length(A) + 1]] <<- r; b <<- c(b, rhs); lab <<- c(lab, name)
  }
  for (t in 1:6) add(which(vars$t == t), 1, DEM[t], paste0("Demand B", t))
  for (k in seq_len(n)) {
    g <- vars$g[k]; t <- vars$t[k]
    add(k, -1, -CAP[g] * avail(g, t), paste("Capacity", GROUPS[g], paste0("B", t)))
  }
  if (1 %in% gi) {
    for (t in 1:6) add(ix(1, t), 1, COAL_MIN * CAP[1], paste0("Coal min B", t))
    for (t in 2:6) {
      add(c(ix(1, t), ix(1, t - 1)), c(-1, 1), -RAMP, paste0("Coal ramp up B", t))
      add(c(ix(1, t), ix(1, t - 1)), c(1, -1), -RAMP, paste0("Coal ramp down B", t))
    }
  }
  if (4 %in% gi) add(sapply(1:6, function(t) ix(4, t)), -H, -WATER, "Hydro water")
  if (!is.null(co2cap)) add(seq_len(n), -H * EM[vars$g], -co2cap, "CO2 cap")
  list(A = do.call(rbind, A), b = b, c = H * mapply(unit_cost, vars$g, vars$t),
       vars = vars, labels = lab)
}

# Lab rule: a column with a single 1 and zeros elsewhere (bottom row included) takes the Solution value of that row.
basic_solution <- function(tab) {
  k <- ncol(tab); out <- numeric(k - 1)
  for (j in 1:(k - 1)) {
    nz <- which(abs(tab[, j]) > EPS)
    if (length(nz) == 1 && abs(tab[nz, j] - 1) < EPS) out[j] <- tab[nz, k]
  }
  out
}

snapshot <- function(tab, it, pc = 0, pr = 0)
  list(iteration = it, rows = lapply(seq_len(nrow(tab)), function(i) round(tab[i, ], 4) + 0),
       pivotCol = pc, pivotRow = pr, basic = round(basic_solution(tab), 4) + 0)

# Steps 3-4: dual tableau [ t(A) | I | Z | c ] with bottom row [ -b | 0 | 1 | 0 ], then pivot.
solve_lp <- function(lp, max_iter = 5000) {
  A <- lp$A; m <- nrow(A); n <- ncol(A); k <- m + n + 2
  tab <- matrix(0, n + 1, k)
  tab[1:n, 1:m] <- t(A); tab[1:n, (m + 1):(m + n)] <- diag(n); tab[1:n, k] <- lp$c
  tab[n + 1, 1:m] <- -lp$b; tab[n + 1, m + n + 1] <- 1
  snaps <- list(snapshot(tab, 0)); it <- 0; status <- "optimal"
  repeat {
    bot <- tab[n + 1, 1:(m + n)]; pc <- which.min(bot)           # most negative entry
    if (bot[pc] >= -EPS) break                                   # no negatives: optimal
    col <- tab[1:n, pc]; pos <- which(col > EPS)
    last <- length(snaps); snaps[[last]]$pivotCol <- pc
    if (length(pos) == 0) { status <- "infeasible"; break }      # no test ratio
    pr <- pos[which.min(tab[pos, k] / col[pos])]                 # smallest test ratio
    snaps[[last]]$pivotRow <- pr
    tab[pr, ] <- tab[pr, ] / tab[pr, pc]                         # Gauss-Jordan
    for (i in setdiff(seq_len(n + 1), pr)) tab[i, ] <- tab[i, ] - tab[i, pc] * tab[pr, ]
    it <- it + 1; snaps[[it + 1]] <- snapshot(tab, it)
    if (it >= max_iter) { status <- "error"; break }
  }
  list(status = status, iterations = it, tab = tab, m = m, n = n, snaps = snaps)
}

# Validation + solving + answer extraction (step 5 of the handout).
solve_request <- function(groups, co2_on, co2_cap) {
  groups <- intersect(GROUPS, as.character(groups))
  if (length(groups) == 0) return(list(status = "invalid", message = "Select at least one plant group."))
  cap <- NULL
  if (isTRUE(co2_on)) {
    cap <- suppressWarnings(as.numeric(co2_cap))
    if (length(cap) != 1 || is.na(cap) || !is.finite(cap) || cap <= 0)
      return(list(status = "invalid", message = "The CO2 cap must be a number greater than 0."))
  }
  lp <- build_lp(groups, cap); r <- solve_lp(lp); m <- r$m; n <- r$n; vars <- lp$vars
  out <- list(status = r$status, iterations = r$iterations, summary = list(unknowns = n, constraints = m),
              headers = c(paste0("S", 1:m), paste0("x", 1:n), "Z", "Solution"),
              constraints = lp$labels, variables = paste(GROUPS[vars$g], paste0("B", vars$t)),
              tableaus = r$snaps)
  if (r$status == "optimal") {
    S <- basic_solution(r$tab)[1:m]; xv <- r$tab[n + 1, (m + 1):(m + n)]
    out$z <- round(r$tab[n + 1, m + n + 2], 2)
    out$x <- lapply(unique(vars$g), function(g) list(group = GROUPS[g], values = round(xv[vars$g == g], 2) + 0))
    out$prices <- round(S[1:6] / H, 2)
    out$check <- round(sum(lp$b * S), 2)                         # sum(RHS x S) must equal Z
  } else if (r$status == "infeasible") out$message <- "The problem is infeasible."
  else out$message <- "The solver stopped before finding an answer."
  out
}

#nolint end