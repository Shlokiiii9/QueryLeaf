import React, { useState } from 'react';

export interface QueryLeafLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  height?: number | string;
  width?: number | string;
  className?: string;
  imgClassName?: string;
  showText?: boolean;
  subtitle?: string;
}

const sizeConfig = {
  xs: {
    heightClass: 'h-5',
    imgHeight: 'h-5',
    defaultPx: 20,
    text: 'text-xs',
    sub: 'text-[9px]',
    gap: 'gap-1.5',
  },
  sm: {
    heightClass: 'h-8',
    imgHeight: 'h-8',
    defaultPx: 32,
    text: 'text-sm font-bold',
    sub: 'text-[10px]',
    gap: 'gap-2.5',
  },
  md: {
    heightClass: 'h-10',
    imgHeight: 'h-10',
    defaultPx: 40,
    text: 'text-base font-bold',
    sub: 'text-[11px]',
    gap: 'gap-3',
  },
  lg: {
    heightClass: 'h-12',
    imgHeight: 'h-12',
    defaultPx: 48,
    text: 'text-lg font-bold',
    sub: 'text-xs',
    gap: 'gap-3.5',
  },
  xl: {
    heightClass: 'h-16',
    imgHeight: 'h-16',
    defaultPx: 64,
    text: 'text-xl font-bold',
    sub: 'text-sm',
    gap: 'gap-4',
  },
};

/**
 * QueryLeaf Brand Logo Component
 * Renders the exact user-uploaded QueryLeaf logo with native aspect ratio,
 * clean transparency, and crisp sizing.
 */
export const QueryLeafLogo: React.FC<QueryLeafLogoProps> = ({
  size = 'sm',
  height,
  width,
  className = '',
  imgClassName = '',
  showText = false,
  subtitle = 'IoT Gateway v1.0',
}) => {
  const [srcIndex, setSrcIndex] = useState(0);
  const imageSources = [
    '/logo-trimmed.png',
    '/QueryLeaf dbms pbl.png',
    '/logo.png',
    '/logo.svg',
  ];

  const conf = sizeConfig[size] || sizeConfig.sm;
  const isImageExhausted = srcIndex >= imageSources.length;

  const handleImageError = () => {
    setSrcIndex((prev) => prev + 1);
  };

  // Custom inline style if explicit height/width are provided
  const imgStyle: React.CSSProperties = {};
  if (height !== undefined) {
    imgStyle.height = typeof height === 'number' ? `${height}px` : height;
  }
  if (width !== undefined) {
    imgStyle.width = typeof width === 'number' ? `${width}px` : width;
  }

  return (
    <div className={`inline-flex items-center ${conf.gap} ${className}`}>
      <div className="shrink-0 flex items-center justify-center relative select-none">
        {!isImageExhausted ? (
          <img
            src={imageSources[srcIndex]}
            alt="QueryLeaf Logo"
            style={imgStyle}
            className={`${
              height || width ? '' : conf.imgHeight
            } w-auto object-contain transition-transform duration-200 hover:scale-[1.03] ${imgClassName}`}
            onError={handleImageError}
            loading="eager"
            decoding="async"
          />
        ) : (
          /* High-fidelity Vector Fallback */
          <svg
            viewBox="0 0 329 425"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={imgStyle}
            className={`${
              height || width ? '' : conf.imgHeight
            } w-auto object-contain`}
          >
            <path
              d="M164 10C80 90 20 200 45 320C65 410 160 415 164 415C168 415 263 410 283 320C308 200 248 90 164 10Z"
              fill="#1B4D3E"
            />
            <path
              d="M164 25V395M164 120L230 170M164 190L98 240M164 260L230 310"
              stroke="#A7F3D0"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <circle cx="230" cy="170" r="14" fill="#34D399" />
            <circle cx="98" cy="240" r="14" fill="#34D399" />
            <circle cx="230" cy="310" r="14" fill="#34D399" />
          </svg>
        )}
      </div>

      {showText && (
        <div className="flex flex-col min-w-0 leading-tight">
          <span className={`text-zinc-900 tracking-tight truncate ${conf.text}`}>
            QueryLeaf
          </span>
          {subtitle && (
            <span className={`text-zinc-500 font-mono truncate ${conf.sub}`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
