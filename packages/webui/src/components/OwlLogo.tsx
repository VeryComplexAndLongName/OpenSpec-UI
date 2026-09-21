import { OWL_LOGO_40, OWL_LOGO_80 } from "../owl-logo.js";

/** The owl at the left of a headline. Decorative: the heading beside it
 * already names the app, so the image carries an empty alternative and
 * the heading's accessible name stays "OpenSpec Workbench".
 * See the-owl-marks-the-app. */
export function OwlLogo() {
  return (
    <img
      className="openspec-shell-logo"
      src={OWL_LOGO_40}
      srcSet={`${OWL_LOGO_40} 1x, ${OWL_LOGO_80} 2x`}
      width={40}
      height={40}
      alt=""
    />
  );
}
