"use client";

export default function PWFBCompanyBrand({
  small = false,
}: {
  small?: boolean;
}) {
  return (
    <div className={`pwfb-company-brand ${small ? "pwfb-company-brand-small" : ""}`}>
      <div className="pwfb-company-logo" aria-hidden="true">
        <span className="pwfb-logo-p">P</span>
        <span className="pwfb-logo-w">W</span>
        <span className="pwfb-logo-f">F</span>
        <span className="pwfb-logo-b">B</span>
      </div>

      <div className="pwfb-company-name">
        Perfect Wisdom For Better Ltd
      </div>
    </div>
  );
}
