"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { CaretLeft, CaretRight, X } from "@/components/icons";

type LightboxImage = { id: number; url: string; alt: string };

export function ImageLightbox({ images }: { images: LightboxImage[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i! - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setOpenIndex((i) => (i! + 1) % images.length);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openIndex, images.length]);

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, i) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted"
          >
            <Image
              src={image.url}
              alt={image.alt}
              fill
              priority={i === 0}
              sizes="(min-width: 640px) 30vw, 45vw"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10"
            onClick={() => setOpenIndex(null)}
          >
            <X className="size-6" />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                className="absolute left-4 flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIndex((i) => (i! - 1 + images.length) % images.length);
                }}
              >
                <CaretLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                className="absolute right-4 flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIndex((i) => (i! + 1) % images.length);
                }}
              >
                <CaretRight className="size-6" />
              </button>
            </>
          )}

          <div className="relative h-full max-h-[85vh] w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Image
              src={images[openIndex].url}
              alt={images[openIndex].alt}
              fill
              sizes="90vw"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
