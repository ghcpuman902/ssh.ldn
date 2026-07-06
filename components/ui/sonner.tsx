"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--background)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "color-mix(in oklch, var(--border) 60%, transparent)",
          "--border-radius": "9999px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast !rounded-full !border-border/60 !bg-white !px-4 !py-3 !text-sm !leading-snug !shadow-[0_1px_2px_rgb(0_0_0/0.04),0_1px_3px_rgb(0_0_0/0.06)] dark:!bg-popover",
          description: "!text-muted-foreground",
          actionButton:
            "!rounded-full !border !border-border/60 !bg-white !px-3 !text-xs !font-medium dark:!bg-popover",
          cancelButton:
            "!rounded-full !border !border-border/60 !bg-muted !px-3 !text-xs !font-medium",
          closeButton:
            "!rounded-full !border !border-border/60 !bg-white !text-muted-foreground hover:!text-foreground dark:!bg-popover",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
