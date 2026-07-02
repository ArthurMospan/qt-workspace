'use client';
import React, { useCallback } from 'react';

/**
 * Stepper Component
 *
 * @component
 * A horizontal step indicator for multi-step processes.
 * Shows progress through numbered steps with visual indicators.
 *
 * @param {Object} props
 * @param {Array<string>} props.steps - Array of step names/labels
 * @param {number} props.currentStep - Current active step (0-indexed)
 * @param {Function} [props.onStepClick] - Callback when clicking a step: (stepIndex) => void
 * @param {string} [props.className] - Additional CSS classes to apply
 */
export function Stepper({ steps = [], currentStep = 0, onStepClick = () => {}, className = '' }) {
  const handleStepClick = useCallback(
    (index) => {
      // Allow clicking previously completed steps or next step for flexibility
      if (index !== currentStep && onStepClick) {
        onStepClick(index);
      }
    },
    [currentStep, onStepClick]
  );

  if (!steps || steps.length === 0) {
    return null;
  }

  const getStepStatus = (index) => {
    if (index < currentStep) return 'completed';
    if (index === currentStep) return 'active';
    return 'pending';
  };

  return (
    <div className={`w-full overflow-x-auto py-2 custom-scrollbar ${className}`}>
      <ol className="flex items-center w-full min-w-[500px] justify-between gap-1">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const isLast = index === steps.length - 1;
          const isClickable = onStepClick && index !== currentStep;

          return (
            <React.Fragment key={index}>
              {/* Step item */}
              <li 
                onClick={() => isClickable && handleStepClick(index)}
                className={`flex items-center gap-3 shrink-0 select-none ${isClickable ? 'cursor-pointer group' : 'cursor-default'}`}
              >
                {/* Circle */}
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all duration-300 shrink-0 ${
                    status === 'completed' 
                      ? 'bg-[#10b981] text-white shadow-sm' 
                      : status === 'active'
                        ? 'bg-[#1f1f1f] text-white shadow-sm ring-4 ring-[#1f1f1f]/10 scale-105'
                        : 'bg-white text-[#9a9a9a] border border-[#e9e9e9] group-hover:border-[#d0d0d0] group-hover:text-[#666666]'
                  }`}
                >
                  {status === 'completed' ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M13.5 4L6 11.5L2.5 8"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Step Label */}
                <span 
                  className={`text-[13px] font-semibold transition-colors duration-300 ${
                    status === 'active' 
                      ? 'text-[#1f1f1f]' 
                      : status === 'completed'
                        ? 'text-[#10b981]'
                        : 'text-[#9a9a9a] group-hover:text-[#666666]'
                  }`}
                >
                  {step}
                </span>
              </li>

              {/* Connecting Line */}
              {!isLast && (
                <li className="flex-1 mx-3 h-[2px] min-w-[30px] rounded-full overflow-hidden bg-[#e9e9e9] shrink">
                  <div 
                    className="h-full bg-[#10b981] transition-all duration-500 ease-in-out rounded-full"
                    style={{ 
                      width: status === 'completed' ? '100%' : '0%' 
                    }}
                  />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}

export default Stepper;
