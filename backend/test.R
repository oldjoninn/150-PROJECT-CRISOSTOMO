# nolint start

# Checks the solver against the 3 test cases in the project PDF:  Rscript test.R
here <- dirname(sub("--file=", "", grep("--file=", commandArgs(FALSE), value = TRUE)))
setwd(here); source("simplex.R")
cases <- list(
  list("Test 1", setdiff(GROUPS, "Geothermal"), NULL, 1149843800.00, 34, c(3800, 6565, 6695, 14700, 14700, 14280)),
  list("Test 2", setdiff(GROUPS, "Solar"), 180000, 1181240745.45, 39, c(8473.45, 8538.45, 18120.23, 18400.23, 18400.23, 8603.45)),
  list("Test 3", setdiff(GROUPS, "Solar"), 165000, NA, 37, NULL))
for (cs in cases) {
  r <- solve_request(cs[[2]], !is.null(cs[[3]]), cs[[3]])
  ok <- r$iterations == cs[[5]]
  if (is.na(cs[[4]])) ok <- ok && r$status == "infeasible"
  else ok <- ok && r$status == "optimal" && abs(r$z - cs[[4]]) / cs[[4]] <= 1e-4 && all(abs(r$prices - cs[[6]]) <= 0.01)
  cat(sprintf("%s: %s | iterations %d (expected %d) | %s\n", cs[[1]], r$status, r$iterations, cs[[5]], if (ok) "PASS" else "FAIL"))
  if (r$status == "optimal") cat("   Z =", format(r$z, big.mark = ",", nsmall = 2), "| prices", r$prices, "\n")
}
bad <- solve_request(character(0), FALSE, NULL); cat("No group  ->", bad$status, "-", bad$message, "\n")
bad <- solve_request("Coal", TRUE, 0);          cat("Cap = 0   ->", bad$status, "-", bad$message, "\n")
bad <- solve_request("Coal", TRUE, "");         cat("Cap blank ->", bad$status, "-", bad$message, "\n")

# nolint end