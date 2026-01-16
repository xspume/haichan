import { motion, AnimatePresence } from 'framer-motion'

interface SuccessAnimationProps {
  isVisible: boolean;
}

export function SuccessAnimation({ isVisible }: SuccessAnimationProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1.2, y: -20 }}
          exit={{ opacity: 0, scale: 0.8, y: -40 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none"
        >
          <div className="bg-background border-2 border-primary p-8 rounded-full shadow-[0_0_30px_rgba(0,255,0,0.3)]">
            <span className="text-6xl">✅</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
