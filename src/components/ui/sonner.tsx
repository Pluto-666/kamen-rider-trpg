"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "#1e1e28",
          "--normal-text": "#e8e8f0",
          "--normal-border": "rgba(196, 30, 58, 0.4)",
          "--border-radius": "var(--radius)",
          "--success-bg": "#1a2e1a",
          "--success-text": "#00ff88",
          "--success-border": "rgba(0, 255, 136, 0.4)",
          "--error-bg": "#2e1a1a",
          "--error-text": "#ff6b6b",
          "--error-border": "rgba(255, 107, 107, 0.4)",
          "--warning-bg": "#2e2a1a",
          "--warning-text": "#ffd700",
          "--warning-border": "rgba(255, 215, 0, 0.4)",
          "--info-bg": "#1a2e3a",
          "--info-text": "#00d4ff",
          "--info-border": "rgba(0, 212, 255, 0.4)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'group-[.toaster]:bg-[#1e1e28] group-[.toaster]:text-[#e8e8f0] group-[.toaster]:border-[#c41e3a]/40 group-[.toaster]:shadow-lg',
          success: 'group-[.toaster]:bg-[#1a2e1a] group-[.toaster]:text-[#00ff88] group-[.toaster]:border-[#00ff88]/40',
          error: 'group-[.toaster]:bg-[#2e1a1a] group-[.toaster]:text-[#ff6b6b] group-[.toaster]:border-[#ff6b6b]/40',
          warning: 'group-[.toaster]:bg-[#2e2a1a] group-[.toaster]:text-[#ffd700] group-[.toaster]:border-[#ffd700]/40',
          info: 'group-[.toaster]:bg-[#1a2e3a] group-[.toaster]:text-[#00d4ff] group-[.toaster]:border-[#00d4ff]/40',
          title: 'group-[.toaster]:font-medium',
          description: 'group-[.toaster]:text-[#c0c0c8]',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
