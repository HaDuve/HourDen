import { Trans } from "react-i18next";
import { Link } from "react-router-dom";
import { metaTextClass } from "../layout/ui-classes.js";

type LoginLegalFooterProps = {
  mode: "login" | "signup";
};

const linkClassName = "underline hover:text-content";

export function LoginLegalFooter({ mode }: LoginLegalFooterProps) {
  const i18nKey = mode === "login" ? "login.legalFooter" : "signup.legalFooter";

  return (
    <p className={`mt-6 text-center ${metaTextClass}`}>
      <Trans
        i18nKey={i18nKey}
        components={{
          termsLink: <Link to="/terms" className={linkClassName} />,
          privacyLink: <Link to="/privacy" className={linkClassName} />,
        }}
      />
    </p>
  );
}
