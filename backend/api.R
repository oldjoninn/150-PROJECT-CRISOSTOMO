# nolint start

source("simplex.R")

#* @filter cors
function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    res$setHeader("Access-Control-Allow-Headers", "Content-Type")
    res$status <- 200
    return(list())
  }
  plumber::forward()
}

#* @get /health
function() list(ok = TRUE)

#* Solve the dispatch problem. Body: {"groups": [...], "co2On": bool, "co2Cap": number|null}
#* @post /solve
#* @serializer json list(auto_unbox = TRUE, digits = NA)
function(req, res) {
  b <- req$body
  out <- tryCatch(solve_request(b$groups, b$co2On, b$co2Cap),
                  error = function(e) list(status = "error", message = "The solver hit an unexpected problem. Please try again."))
  if (out$status %in% c("invalid", "error")) res$status <- 400
  out
}

# nolint end