"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface TimelineNodeProps {
  date: string;
  title: string;
  description: string;
  index: number;
  points?: number;
  details?: readonly string[];
  deliverables?: readonly string[];
}

export default function TimelineNode({
  date,
  title,
  description,
  index,
  points,
  details,
  deliverables,
}: TimelineNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasExpandableContent = details && details.length > 0 || deliverables && deliverables.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: index * 0.2 }}
      viewport={{ once: true }}
      className="relative flex gap-8 items-start"
    >
      {/* Glowing node */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          boxShadow: [
            "0 0 20px rgba(124,58,237,0.5)",
            "0 0 40px rgba(124,58,237,0.8)",
            "0 0 20px rgba(124,58,237,0.5)",
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="w-8 h-8 rounded-full bg-gradient-to-r from-neon-purple to-electric-blue border-4 border-white/20 z-10 flex-shrink-0 mt-6"
      />

      {/* Content */}
      <div className="flex-1">
        <motion.div
          onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
          className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 ${
            hasExpandableContent ? "cursor-pointer hover:bg-white/10 transition-colors" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="text-hot-pink font-bold text-sm mb-2">{date}</div>
              <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
              <p className="text-gray-400">{description}</p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              {points !== undefined && points > 0 && (
                <div className="bg-gradient-to-r from-neon-purple to-electric-blue text-white font-bold px-4 py-2 rounded-lg text-sm whitespace-nowrap">
                  {points} pts
                </div>
              )}
              {hasExpandableContent && (
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronDown className="text-white/50" size={24} />
                </motion.div>
              )}
            </div>
          </div>

          {/* Expandable content */}
          <AnimatePresence>
            {isExpanded && hasExpandableContent && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                  {details && details.length > 0 && (
                    <div>
                      <h4 className="text-white font-bold mb-3 text-lg">Activities:</h4>
                      <ul className="space-y-2">
                        {details.map((detail, idx) => (
                          <li key={idx} className="text-gray-300 flex items-start gap-2">
                            <span className="text-electric-blue mt-1">•</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {deliverables && deliverables.length > 0 && (
                    <div>
                      <h4 className="text-white font-bold mb-3 text-lg">Deliverables:</h4>
                      <ul className="space-y-2">
                        {deliverables.map((deliverable, idx) => (
                          <li key={idx} className="text-gray-300 flex items-start gap-2">
                            <span className="text-hot-pink mt-1">✓</span>
                            <span>{deliverable}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

