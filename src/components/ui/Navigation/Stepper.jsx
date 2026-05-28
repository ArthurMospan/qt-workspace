import React, { useCallback } from 'react';
import { colors, sizing, spacing } from '@/lib/design/tokens';

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
 *
 * @example
 * const [step, setStep] = useState(0);
 * <Stepper
 *   steps={['Personal Info', 'Address', 'Confirmation']}
 *   currentStep={step}
 *   onStepClick={setStep}
 * />
 */
export function Stepper({ steps = [], currentStep = 0, onStepClick = () => {}, className = '' }) {
  if (!steps || steps.length === 0) {
    return null;
  }

  const handleStepClick = useCallback(
    (index) => {
      if (index !== currentStep) {
        onStepClick(index);
      }
    },
    [currentStep, onStepClick]
  );

  const getStepStatus = (index) => {
    if (index < currentStep) return 'completed';
    if (index === currentStep) return 'active';
    return 'pending';
  };

  const stepCircleSize = 40;
  const stepLineHeight = 2;

  return (
    <div className={`flex items-center justify-center gap-[${spacing.xs}] ${className}`}>
      <ol className="flex items-center w-full gap-[12px]">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const isLast = index === steps.length - 1;
          const isClickable = index !== currentStep;

          // Determine colors based on status
          let circleColor = colors.text.inactive; // pending
          let circleTextColor = colors.text.muted;
          let circleBorder = `2px solid ${colors.border.primary}`;

          if (status === 'completed') {
            circleColor = colors.status.success;
            circleTextColor = colors.surface;
            circleBorder = `2px solid ${colors.status.success}`;
          } else if (status === 'active') {
            circleColor = colors.dark;
            circleTextColor = colors.surface;
            circleBorder = `2px solid ${colors.dark}`;
          } else if (status === 'pending') {
            circleColor = colors.surface;
            circleTextColor = colors.text.muted;
            circleBorder = `2px solid ${colors.border.primary}`;
          }

          return (
            <li key={index} className="flex items-center flex-1">
              {/* Step Circle */}
              <button
                onClick={() => handleStepClick(index)}
                disabled={!isClickable}
                style={{
                  width: stepCircleSize,
                  height: stepCircleSize,
                  minWidth: stepCircleSize,
                  minHeight: stepCircleSize,
                  borderRadius: '50%',
                  backgroundColor: circleColor,
                  border: circleBorder,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: circleTextColor,
                  cursor: isClickable ? 'pointer' : 'default',
                  transition: 'all 200ms ease-in-out',
                  position: 'relative',
                  zIndex: 2,
                }}
                onMouseEnter={(e) => {
                  if (isClickable && status !== 'completed') {
                    e.currentTarget.style.opacity = '0.8';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isClickable) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
                aria-label={`Step ${index + 1}: ${step}`}
                aria-current={status === 'active' ? 'step' : undefined}
              >
                {status === 'completed' ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13.5 4L6 11.5L2.5 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </button>

              {/* Connecting Line */}
              {!isLast && (
                <div
                  style={{
                    flex: 1,
                    height: stepLineHeight,
                    backgroundColor:
                      status === 'completed' ? colors.status.success : colors.border.primary,
                    marginLeft: spacing.sm,
                    transition: 'background-color 200ms ease-in-out',
                  }}
                />
              )}

              {/* Step Label */}
              <div
                style={{
                  marginLeft: spacing.sm,
                  minWidth: 0,
                  cursor: isClickable ? 'pointer' : 'default',
                  transition: 'opacity 200ms ease-in-out',
                }}
                onClick={() => handleStepClick(index)}
                onMouseEnter={(e) => {
                  if (isClickable) {
                    e.currentTarget.style.opacity = '0.7';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isClickable) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: status === 'active' ? colors.dark : colors.text.muted,
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default Stepper;
