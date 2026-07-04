import Image from "next/image"

import { cn } from "@/lib/utils"

const ELEVENLABS_LOGO_PATH = "/elevenlabs-logo-black.svg"

type ElevenLabsMarkProps = {
  className?: string
}

export const ElevenLabsMark = ({ className }: ElevenLabsMarkProps) => (
  <div
    className={cn("flex items-center justify-end gap-1.5", className)}
    aria-label="Powered by ElevenLabs"
  >
    <span className="text-[0.65rem] text-muted-foreground">Powered by</span>
    <Image
      src={ELEVENLABS_LOGO_PATH}
      alt="ElevenLabs"
      width={694}
      height={90}
      className="h-3 w-auto shrink-0"
    />
  </div>
)
