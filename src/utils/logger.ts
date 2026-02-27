const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

/** Formatted logging with color-coded prefixes. */
export const log = {
  /** Log an informational message. */
  info(msg: string) {
    console.log(`${BLUE}${BOLD}info${RESET} ${msg}`);
  },

  /** Log a success message. */
  success(msg: string) {
    console.log(`${GREEN}${BOLD}done${RESET} ${msg}`);
  },

  /** Log a warning message. */
  warn(msg: string) {
    console.log(`${YELLOW}${BOLD}warn${RESET} ${msg}`);
  },

  /** Log an error message. */
  error(msg: string) {
    console.error(`${RED}${BOLD}err!${RESET} ${msg}`);
  },

  /** Log a step being performed. */
  step(msg: string) {
    console.log(`${CYAN}${BOLD}  -> ${RESET}${msg}`);
  },

  /** Log a dimmed/debug message. */
  dim(msg: string) {
    console.log(`${DIM}     ${msg}${RESET}`);
  },

  /** Print a blank line. */
  blank() {
    console.log();
  },
};
