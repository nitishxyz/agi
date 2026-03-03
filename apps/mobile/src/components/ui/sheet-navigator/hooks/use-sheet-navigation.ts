import { useState, useCallback, useMemo } from "react";
import type { StepDefinition, NavigationState } from "../types";

interface UseSheetNavigationProps {
  steps: StepDefinition[];
  initialData?: any;
  onComplete?: (data: any) => Promise<void> | void;
}

export const useSheetNavigation = ({ 
  steps, 
  initialData = {}, 
  onComplete 
}: UseSheetNavigationProps) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [data, setData] = useState(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const currentStep = steps[currentStepIndex];

  const updateData = useCallback((updates: any) => {
    setData((prev: any) => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const updatedFields = Object.keys(updates);
    setErrors((prev: Record<string, string>) => {
      const newErrors = { ...prev };
      updatedFields.forEach(field => delete newErrors[field]);
      return newErrors;
    });
  }, []);

  const validateCurrentStep = useCallback((): boolean => {
    if (!currentStep?.validation) return true;
    
    const result = currentStep.validation(data);
    
    if (typeof result === "string") {
      setErrors(prev => ({ ...prev, [currentStep.id]: result }));
      return false;
    }
    
    if (!result) {
      setErrors(prev => ({ ...prev, [currentStep.id]: "Invalid data" }));
      return false;
    }
    
    // Clear errors if validation passes
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[currentStep.id];
      return newErrors;
    });
    
    return true;
  }, [currentStep, data]);

  const goNext = useCallback(async () => {
    if (!validateCurrentStep()) return;
    
    if (currentStepIndex === steps.length - 1) {
      // Last step - complete the flow
      setIsLoading(true);
      try {
        if (onComplete) {
          await onComplete(data);
        }
      } catch (error) {
        setErrors(prev => ({ ...prev, complete: "Failed to complete" }));
        setIsLoading(false);
      }
      return;
    }
    
    // Move to next step
    setHistory(prev => [...prev, currentStep.id]);
    setCurrentStepIndex(prev => prev + 1);
  }, [currentStepIndex, steps.length, validateCurrentStep, onComplete, data, currentStep]);

  const goBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      setHistory(prev => prev.slice(0, -1));
    }
  }, [currentStepIndex]);

  const reset = useCallback(() => {
    setCurrentStepIndex(0);
    setData(initialData);
    setErrors({});
    setHistory([]);
    setIsLoading(false);
  }, [initialData]);

  const canGoNext = useMemo(() => {
    return currentStep?.canGoNext !== false && !isLoading;
  }, [currentStep, isLoading]);

  const canGoBack = useMemo(() => {
    return currentStepIndex > 0 && currentStep?.canGoBack !== false && !isLoading;
  }, [currentStepIndex, currentStep, isLoading]);

  const navigationState: NavigationState = {
    currentStepIndex,
    currentStep,
    data,
    errors,
    history,
    isLoading,
    canGoNext,
    canGoBack,
  };

  return {
    ...navigationState,
    updateData,
    goNext,
    goBack,
    reset,
    setIsLoading,
    setErrors,
  };
};