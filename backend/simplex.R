# ============================================================
# Problem Constants & Helper Functions
# ============================================================
# nolint start
EPS <- 1e-9

GROUPS <- c("Coal", "Natural Gas", "Geothermal", "Hydro", "Oil-based", "Solar", "Wind")
CAP    <- c(7000, 3300, 800, 2500, 1500, 2500, 400)
EM     <- c(0.95, 0.40, 0.10, 0, 0.75, 0, 0)
B1     <- c(3800, 6500, 1500, 300, 14000, 40, 60)
FUEL   <- c(TRUE, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE)
HEAT   <- c(1.00, 1.01, 1.03, 1.05, 1.04, 1.02)
DEM    <- c(6300, 8600, 11800, 12300, 14000, 10600)
A_SOLAR <- c(0, 0.10, 0.60, 0.55, 0.08, 0)
A_WIND  <- c(0.35, 0.30, 0.25, 0.25, 0.30, 0.35)

H <- 4
RAMP <- 1500
WATER <- 8000
COAL_MIN <- 0.40

get_unit_cost <- function(g, t) {
  if (FUEL[g]) {
    return(round(B1[g] * HEAT[t]))
  } else {
    return(B1[g])
  }
}

get_avail <- function(g, t) {
  if (GROUPS[g] == "Solar") {
    return(A_SOLAR[t])
  } else if (GROUPS[g] == "Wind") {
    return(A_WIND[t])
  } else {
    return(1)
  }
}

# ============================================================
#  Simplex Method 
# ============================================================

Simplex <- function(tableau, isMax, max_iter = 5000) { 
  data <- as.matrix(tableau)
  num_rows <- nrow(data)
  num_cols <- ncol(data)
  z_row <- num_rows
  rhs_col <- num_cols
  num_vars <- num_cols - 1

  # Give default column names if none were provided.
  if (is.null(colnames(data))) {
    default_names <- c()
    for (j in 1:num_vars) {
      default_names <- c(default_names, paste0("x", j))
    }
    default_names <- c(default_names, "RHS")
    colnames(data) <- default_names
  }

  # Find the "Z" column, if the tableau has one.
  z_col <- 0
  for (j in 1:num_vars) {
    if (toupper(colnames(data)[j]) == "Z") {
      z_col <- j
    }
  }

  # Build the list of columns we are allowed to pivot on.
  candidate_cols <- c()
  for (j in 1:num_vars) {
    if (j != z_col) {
      candidate_cols <- c(candidate_cols, j)
    }
  }

  # Identify slack columns (S1, S2, ...) vs decision variable columns (x1, x2, ...).
  # If column names start with "S", use that directly; otherwise detect initial unit columns.
  is_slack <- c()
  for (k in seq_along(candidate_cols)) {
    j <- candidate_cols[k]
    col_name <- toupper(colnames(data)[j])
    if (startsWith(col_name, "S")) {
      is_slack <- c(is_slack, TRUE)
    } else if (startsWith(col_name, "X")) {
      is_slack <- c(is_slack, FALSE)
    } else {
      ones <- 0
      zeros <- 0
      for (i in 1:(num_rows - 1)) {
        if (abs(data[i, j] - 1) < EPS) {
          ones <- ones + 1
        } else if (abs(data[i, j]) < EPS) {
          zeros <- zeros + 1
        }
      }
      if (ones == 1 && zeros == (num_rows - 2) && abs(data[z_row, j]) < EPS) {
        is_slack <- c(is_slack, TRUE)
      } else {
        is_slack <- c(is_slack, FALSE)
      }
    }
  }

  # Helper to read basic solution at any iteration (for tableau snapshots).
  read_basic_solution <- function(mat) {
    sol <- numeric(num_vars)
    for (k in seq_along(candidate_cols)) {
      j <- candidate_cols[k]
      if (!is_slack[k] && isMax == FALSE) {
        sol[j] <- mat[z_row, j]
      } else {
        ones <- 0
        zeros <- 0
        one_row <- -1
        for (i in 1:(num_rows - 1)) {
          if (abs(mat[i, j] - 1) < EPS) {
            ones <- ones + 1
            one_row <- i
          } else if (abs(mat[i, j]) < EPS) {
            zeros <- zeros + 1
          }
        }
        if (ones == 1 && zeros == (num_rows - 2) && abs(mat[z_row, j]) < EPS) {
          sol[j] <- mat[one_row, rhs_col]
        } else {
          sol[j] <- 0
        }
      }
    }
    return(sol)
  }

  # Helper to save a tableau snapshot for each iteration.
  make_snapshot <- function(mat, iter, p_col = 0, p_row = 0) {
    row_list <- list()
    for (i in 1:num_rows) {
      row_list[[i]] <- round(as.numeric(mat[i, ]), 4) + 0
    }
    list(
      iteration = iter,
      rows = row_list,
      pivotCol = p_col,
      pivotRow = p_row,
      basic = round(read_basic_solution(mat), 4) + 0
    )
  }

  snapshots <- list()
  snapshots[[1]] <- make_snapshot(data, 0)

  iter <- 0
  status <- "optimal"

  # Pivoting loop: same steps for maximization and minimization.
  while (TRUE) {
    # Find the most negative entry in the objective row among candidate columns.
    pivot_col <- candidate_cols[1]
    smallest_value <- data[z_row, pivot_col]
    for (k in seq_along(candidate_cols)) {
      j <- candidate_cols[k]
      if (data[z_row, j] < smallest_value) {
        smallest_value <- data[z_row, j]
        pivot_col <- j
      }
    }

    # Optimal once nothing is negative anymore (within EPS tolerance).
    if (smallest_value >= -EPS) {
      break
    }

    snapshots[[length(snapshots)]]$pivotCol <- pivot_col

    # Ratio test to find the pivot row.
    pivot_row <- -1
    best_ratio <- Inf
    for (i in 1:(num_rows - 1)) {
      if (data[i, pivot_col] > EPS) {
        ratio <- data[i, rhs_col] / data[i, pivot_col]
        if (ratio < best_ratio - EPS) {
          best_ratio <- ratio
          pivot_row <- i
        }
      }
    }

    # If no positive entry exists in the pivot column, the dual is unbounded (primal is infeasible).
    if (pivot_row == -1) {
      status <- "infeasible"
      break
    }

    snapshots[[length(snapshots)]]$pivotRow <- pivot_row

    # Normalize the pivot row.
    pivot_value <- data[pivot_row, pivot_col]
    for (j in 1:num_cols) {
      data[pivot_row, j] <- data[pivot_row, j] / pivot_value
    }

    # Zero out the rest of the pivot column.
    for (i in 1:num_rows) {
      if (i != pivot_row) {
        factor <- data[i, pivot_col]
        for (j in 1:num_cols) {
          data[i, j] <- data[i, j] - factor * data[pivot_row, j]
        }
      }
    }

    iter <- iter + 1
    snapshots[[iter + 1]] <- make_snapshot(data, iter)

    if (iter >= max_iter) {
      status <- "error"
      break
    }
  }

  # Read the final values.
  raw_sol <- read_basic_solution(data)
  solution <- c()
  var_names <- c()

  for (k in seq_along(candidate_cols)) {
    j <- candidate_cols[k]
    var_names <- c(var_names, colnames(data)[j])
    solution <- c(solution, raw_sol[j])
  }

  basic_solution <- matrix(solution, nrow = 1)
  colnames(basic_solution) <- var_names
  rownames(basic_solution) <- "Value"

  z_value <- data[z_row, rhs_col]

  list(
    status = status,
    iterations = iter,
    finalTableau = data,
    basicSolution = basic_solution,
    Z = z_value,
    snaps = snapshots
  )
}

# ============================================================
# S Build Primal Constraints (>=) & Dual Tableau
# ============================================================

build_lp <- function(sel, co2cap = NULL) {
  gi <- which(GROUPS %in% sel)
  vars <- expand.grid(t = 1:6, g = gi) # group by group, B1..B6
  n <- nrow(vars)

  find_var_idx <- function(g, t) {
    which(vars$g == g & vars$t == t)
  }

  A_rows <- list()
  b_vec <- numeric(0)
  labels <- character(0)

  add_constraint <- function(cols, vals, rhs, name) {
    row <- numeric(n)
    row[cols] <- vals
    A_rows[[length(A_rows) + 1]] <<- row
    b_vec <<- c(b_vec, rhs)
    labels <<- c(labels, name)
  }

  # Demand constraints: sum_g x_{g,t} >= DEM[t]
  for (t in 1:6) {
    t_cols <- which(vars$t == t)
    add_constraint(t_cols, 1, DEM[t], paste0("Demand B", t))
  }

  # Capacity constraints: -x_{g,t} >= -CAP[g] * avail(g, t)
  for (k in 1:n) {
    g <- vars$g[k]
    t <- vars$t[k]
    add_constraint(k, -1, -CAP[g] * get_avail(g, t), paste("Capacity", GROUPS[g], paste0("B", t)))
  }

  # Coal minimum & ramp limits (if Coal is selected)
  if (1 %in% gi) {
    for (t in 1:6) {
      add_constraint(find_var_idx(1, t), 1, COAL_MIN * CAP[1], paste0("Coal min B", t))
    }
    for (t in 2:6) {
      c_curr <- find_var_idx(1, t)
      c_prev <- find_var_idx(1, t - 1)
      add_constraint(c(c_curr, c_prev), c(-1, 1), -RAMP, paste0("Coal ramp up B", t))
      add_constraint(c(c_curr, c_prev), c(1, -1), -RAMP, paste0("Coal ramp down B", t))
    }
  }

  # Hydro water constraint (if Hydro is selected)
  if (4 %in% gi) {
    hydro_cols <- c()
    for (t in 1:6) {
      hydro_cols <- c(hydro_cols, find_var_idx(4, t))
    }
    add_constraint(hydro_cols, -H, -WATER, "Hydro water")
  }

  # CO2 emission cap (if enabled)
  if (!is.null(co2cap)) {
    em_coeffs <- c()
    for (k in 1:n) {
      em_coeffs <- c(em_coeffs, -H * EM[vars$g[k]])
    }
    add_constraint(1:n, em_coeffs, -co2cap, "CO2 cap")
  }

  # Objective coefficients: H * unit_cost(g, t)
  c_vec <- numeric(n)
  for (k in 1:n) {
    c_vec[k] <- H * get_unit_cost(vars$g[k], vars$t[k])
  }

  A_mat <- do.call(rbind, A_rows)
  m <- nrow(A_mat)

  # Build Dual Tableau: [ t(A) | I_n | Z | c ] with bottom row [ -b | 0 | 1 | 0 ]
  total_cols <- m + n + 2
  tableau <- matrix(0, nrow = n + 1, ncol = total_cols)

  tableau[1:n, 1:m] <- t(A_mat)
  tableau[1:n, (m + 1):(m + n)] <- diag(n)
  tableau[1:n, total_cols] <- c_vec

  tableau[n + 1, 1:m] <- -b_vec
  tableau[n + 1, m + n + 1] <- 1
  tableau[n + 1, total_cols] <- 0

  colnames(tableau) <- c(paste0("S", 1:m), paste0("x", 1:n), "Z", "Solution")

  list(
    A = A_mat,
    b = b_vec,
    c = c_vec,
    m = m,
    n = n,
    vars = vars,
    labels = labels,
    tableau = tableau
  )
}

# ============================================================
# Validation, Solving & Answer Extraction
# ============================================================

solve_request <- function(groups, co2_on, co2_cap) {
  groups <- intersect(GROUPS, as.character(groups))
  if (length(groups) == 0) {
    return(list(status = "invalid", message = "Select at least one plant group."))
  }

  cap <- NULL
  if (isTRUE(co2_on)) {
    cap <- suppressWarnings(as.numeric(co2_cap))
    if (length(cap) != 1 || is.na(cap) || !is.finite(cap) || cap <= 0) {
      return(list(status = "invalid", message = "The CO2 cap must be a number greater than 0."))
    }
  }

  lp <- build_lp(groups, cap)
  res <- Simplex(lp$tableau, isMax = FALSE)
  m <- lp$m
  n <- lp$n
  vars <- lp$vars

  var_labels <- c()
  for (k in 1:n) {
    var_labels <- c(var_labels, paste(GROUPS[vars$g[k]], paste0("B", vars$t[k])))
  }

  out <- list(
    status = res$status,
    iterations = res$iterations,
    summary = list(unknowns = n, constraints = m),
    headers = colnames(lp$tableau),
    constraints = lp$labels,
    variables = var_labels,
    tableaus = res$snaps
  )

  if (res$status == "optimal") {
    sol_vec <- as.numeric(res$basicSolution)
    S_vals <- sol_vec[1:m]
    x_vals <- sol_vec[(m + 1):(m + n)]

    out$z <- round(res$Z, 2)

    unique_groups <- unique(vars$g)
    x_grouped <- list()
    for (idx in seq_along(unique_groups)) {
      g <- unique_groups[idx]
      g_vals <- round(x_vals[vars$g == g], 2) + 0
      x_grouped[[idx]] <- list(group = GROUPS[g], values = g_vals)
    }
    out$x <- x_grouped

    out$prices <- round(S_vals[1:6] / H, 2)
    out$check <- round(sum(lp$b * S_vals), 2)
  } else if (res$status == "infeasible") {
    out$message <- "The problem is infeasible."
  } else {
    out$message <- "The solver stopped before finding an answer."
  }

  return(out)
}
# nolint end