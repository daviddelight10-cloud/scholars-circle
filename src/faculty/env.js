// faculty.<domain> serves the staff shell for every path; the same shell is
// also reachable at /faculty/* on the main domain (previews, dev).
export const IS_FACULTY_HOST = /^faculty\./i.test(window.location.hostname);

// Student-app URL — strips the faculty. subdomain when the portal runs on one.
export const STUDENT_APP_URL = IS_FACULTY_HOST
  ? `${window.location.protocol}//${window.location.host.replace(/^faculty\./i, "")}/app`
  : "/app";

export const STUDENT_SIGNUP_URL = IS_FACULTY_HOST
  ? `${window.location.protocol}//${window.location.host.replace(/^faculty\./i, "")}/signup`
  : "/signup";

// Staff-portal URL for links inside the student app: the faculty.<domain>
// subdomain on the production domain, the /faculty path elsewhere (Vercel
// previews, localhost — subdomains aren't available there).
export const FACULTY_PORTAL_URL = /(^|\.)scholarscircle\.com\.ng$/i.test(window.location.hostname)
  ? "https://faculty.scholarscircle.com.ng"
  : "/faculty";
