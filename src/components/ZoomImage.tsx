import { useEffect, useState } from "react";

/**
 * 试卷材料图（信息检索页面扫描等）点击全屏查看。
 * 卡片内的默认尺寸读不清扫描件里的小字，点击进入全屏 lightbox 放大查看，Esc / 点击关闭。
 * src 传入 assetSrc() 之后的最终地址。
 */
export function ZoomImage({ src, className = "", alt = "" }: { src: string; className?: string; alt?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("lightbox-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("lightbox-open");
    };
  }, [open]);
  return (
    <>
      <img className={`${className} zoomable-image`.trim()} src={src} alt={alt} onClick={() => setOpen(true)} />
      {open ? (
        <section className="image-lightbox" role="dialog" aria-modal="true" aria-label="查看大图" onClick={() => setOpen(false)}>
          <img src={src} alt={alt} />
        </section>
      ) : null}
    </>
  );
}
