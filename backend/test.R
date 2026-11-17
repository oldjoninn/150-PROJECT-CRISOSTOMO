# nolint start

# checks the solver against the 3 test cases in the project pdf using rscript test.R

# get the directory of the current script and set it as the working directory
script_args <- commandArgs(FALSE)
file_arg <- grep("--file=", script_args, value = TRUE)
script_dir <- dirname(sub("--file=", "", file_arg))
setwd(script_dir)

# load the simplex solver implementation
source("simplex.R")

# define the test cases using named lists for better readability
# each case specifies the name active energy groups optional cap expected objective value z expected iterations and expected prices
test_cases <- list(
  list(
    name = "Test 1",
    active_groups = setdiff(GROUPS, "Geothermal"),
    cap_value = NULL,
    expected_z = 1149843800.00,
    expected_iters = 34,
    expected_prices = c(3800, 6565, 6695, 14700, 14700, 14280)
  ),
  list(
    name = "Test 2",
    active_groups = setdiff(GROUPS, "Solar"),
    cap_value = 180000,
    expected_z = 1181240745.45,
    expected_iters = 39,
    expected_prices = c(8473.45, 8538.45, 18120.23, 18400.23, 18400.23, 8603.45)
  ),
  list(
    name = "Test 3",
    active_groups = setdiff(GROUPS, "Solar"),
    cap_value = 165000,
    expected_z = NA,
    expected_iters = 37,
    expected_prices = NULL
  )
)

# iterate through each test case and validate the solver output
for (case in test_cases) {
  has_cap <- !is.null(case$cap_value)
  result <- solve_request(case$active_groups, has_cap, case$cap_value)
  
  # verify that the iteration count matches the expected value
  iters_match <- result$iterations == case$expected_iters
  
  # check feasibility or optimality conditions depending on the test case
  if (is.na(case$expected_z)) {
    is_passed <- iters_match && (result$status == "infeasible")
  } else {
    z_within_tol <- abs(result$z - case$expected_z) / case$expected_z <= 1e-4
    prices_within_tol <- all(abs(result$prices - case$expected_prices) <= 0.01)
    is_passed <- iters_match && (result$status == "optimal") && z_within_tol && prices_within_tol
  }
  
  # print the summary result for the current test case
  status_label <- if (is_passed) "PASS" else "FAIL"
  cat(sprintf(
    "%s: %s | iterations %d (expected %d) | %s\n",
    case$name,
    result$status,
    result$iterations,
    case$expected_iters,
    status_label
  ))
  
  # print the objective value and price vector if an optimal solution was found
  if (result$status == "optimal") {
    formatted_z <- format(result$z, big.mark = ",", nsmall = 2)
    cat("   Z =", formatted_z, "| prices", result$prices, "\n")
  }
}

# run edge case tests to verify input validation and error handling
cat("\n--- Edge Case Validation ---\n")

# test empty energy group selection
err_no_group <- solve_request(character(0), FALSE, NULL)
cat("No group  ->", err_no_group$status, "-", err_no_group$message, "\n")

# test zero capacity cap
err_zero_cap <- solve_request("Coal", TRUE, 0)
cat("Cap = 0   ->", err_zero_cap$status, "-", err_zero_cap$message, "\n")

# test blank string capacity cap
err_blank_cap <- solve_request("Coal", TRUE, "")
cat("Cap blank ->", err_blank_cap$status, "-", err_blank_cap$message, "\n")

# nolint end