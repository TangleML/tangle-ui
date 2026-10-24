import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { NoticeBanners } from "@/components/shared/Notices/NoticeBanners";
import { NOTICE_BANNERS_HEIGHT_VAR } from "@/utils/layout";

import { hasAppMenu } from "./AppMenu";

const NoticeBannersRegion = () => {
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;

    const rootStyle = document.documentElement.style;
    const observer = new ResizeObserver(() => {
      rootStyle.setProperty(
        NOTICE_BANNERS_HEIGHT_VAR,
        `${region.offsetHeight}px`,
      );
    });
    observer.observe(region);

    return () => {
      observer.disconnect();
      rootStyle.removeProperty(NOTICE_BANNERS_HEIGHT_VAR);
    };
  }, []);

  return (
    <div
      ref={regionRef}
      className="w-full shrink-0 border-b border-border px-8 py-4 empty:hidden"
    >
      <NoticeBanners />
    </div>
  );
};

export const AppNoticeBanners = () => {
  const { pathname } = useLocation();

  if (!hasAppMenu(pathname)) return null;

  return <NoticeBannersRegion />;
};
