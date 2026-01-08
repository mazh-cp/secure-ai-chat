'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'

interface LogoProps {
  className?: string
  size?: 'small' | 'medium' | 'large'
  asHeader?: boolean
}

export default function Logo({ className = '', size = 'medium', asHeader = false }: LogoProps) {
  const [useImageFile, setUseImageFile] = useState(false)

  useEffect(() => {
    // Check if logo image exists in public folder
    if (typeof window !== 'undefined') {
      const checkImage = async () => {
        try {
          const img = new window.Image()
          img.onload = () => setUseImageFile(true)
          img.onerror = () => setUseImageFile(false)
          img.src = '/checkpoint-logo.png'
        } catch {
          setUseImageFile(false)
        }
      }
      checkImage()
    }
  }, [])

  const sizeClasses = {
    small: { icon: 'w-12 h-12', text: 'text-base', imgWidth: 150, imgHeight: 45 },
    medium: { icon: 'w-16 h-16', text: 'text-xl', imgWidth: 180, imgHeight: 54 },
    large: { icon: 'w-24 h-24', text: 'text-2xl', imgWidth: 240, imgHeight: 72 },
  }

  const sizes = sizeClasses[size]

  // If image file exists, use it
  if (useImageFile) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="flex items-center">
          <Image
            src="/checkpoint-logo.png"
            alt="Check Point"
            width={asHeader ? 200 : sizes.imgWidth}
            height={asHeader ? 60 : sizes.imgHeight}
            className="object-contain"
            priority={asHeader}
            unoptimized
          />
        </div>
      </div>
    )
  }

  // Fallback to SVG based on accurate description
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex items-center space-x-3">
        {/* Logo Icon - Based on accurate description */}
        <div className={`${sizes.icon} relative flex-shrink-0`}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 120 120"
            className="block"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Large solid pink circle */}
            <circle cx="60" cy="60" r="50" fill="#E91E63" />
            
            {/* Small circular cutout/bite mark on top-right */}
            {/* This is created by masking the pink circle */}
            <defs>
              <mask id="circleMask">
                <rect width="120" height="120" fill="white" />
                {/* Cutout circle - creates bite mark */}
                <circle cx="95" cy="35" r="14" fill="black" />
              </mask>
            </defs>
            
            {/* Apply mask to create bite mark effect */}
            <circle cx="60" cy="60" r="50" fill="#E91E63" mask="url(#circleMask)" />
            
            {/* Dark gray/black circle revealed by cutout (positioned just outside pink circle) */}
            <circle cx="95" cy="35" r="12" fill="#2C2C2C" />
            
            {/* Stylized network icon inside pink circle - dark gray/black */}
            <g fill="#2C2C2C" stroke="#2C2C2C" strokeWidth="2">
              {/* Small square node on top left */}
              <rect x="35" y="35" width="8" height="8" rx="1" />
              {/* Two small circular nodes below */}
              <circle cx="50" cy="60" r="5" />
              <circle cx="70" cy="70" r="5" />
              {/* Lines connecting the nodes */}
              <line x1="39" y1="39" x2="50" y2="60" stroke="#2C2C2C" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="50" y1="60" x2="70" y2="70" stroke="#2C2C2C" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="35" y1="43" x2="50" y2="60" stroke="#2C2C2C" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          </svg>
        </div>
        
        {/* Text "CHECK POINT™" */}
        <div className="flex flex-col justify-center">
          <div className="flex items-baseline">
            <span className={`${sizes.text} font-bold text-gray-900 dark:text-white tracking-tight leading-none`}>
              CHECK POINT
            </span>
            <span className="text-[10px] text-gray-900 dark:text-white leading-none ml-0.5 align-top">™</span>
          </div>
        </div>
      </div>
    </div>
  )
}
