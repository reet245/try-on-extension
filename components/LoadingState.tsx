import { motion } from 'framer-motion';

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      {/* Animated clothing icon */}
      <div className="relative">
        <motion.div
          className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <svg
            className="w-10 h-10 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
              strokeWidth="2"
            />
            <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2" />
            <path d="M16 10a4 4 0 01-8 0" strokeWidth="2" />
          </svg>
        </motion.div>
      </div>

      {/* Progress text */}
      <div className="text-center space-y-2">
        <motion.p
          className="font-medium text-sm"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Creating your look...
        </motion.p>
        <p className="text-xs text-muted-foreground">
          This usually takes 10-20 seconds
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
    </div>
  );
}
