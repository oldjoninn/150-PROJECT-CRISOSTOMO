# nolint start

# Start the API:  Rscript run.R   (from anywhere)
library(plumber)
here <- dirname(sub("--file=", "", grep("--file=", commandArgs(FALSE), value = TRUE)))
setwd(here)
plumb("api.R")$run(host = "0.0.0.0", port = 8000)

# nolint end