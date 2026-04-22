export interface StepDefinition {
  id: string;
  title?: string;
  component: React.ComponentType<StepProps>;
  validation?: (data: any) => boolean | string;
  canGoBack?: boolean;
  canGoNext?: boolean;
  isOptional?: boolean;
}

export interface StepProps {
  data: any;
  updateData: (updates: any) => void;
  goNext: () => void;
  goBack: () => void;
  dismiss?: () => void; // Function to dismiss the modal
  isLoading?: boolean;
  errors?: Record<string, string>;
  stepIndex: number;
  totalSteps: number;
  setStepComplete?: (complete: boolean) => void; // New prop to mark step as complete
}

export interface SheetNavigatorProps {
  visible: boolean;
  onClose: () => void;
  steps: StepDefinition[];
  onComplete?: (data: any) => void;
  initialData?: any;
  disableBackdrop?: boolean;
  showProgress?: boolean;
  title?: string;
}

export interface NavigationState {
  currentStepIndex: number;
  currentStep: StepDefinition;
  data: Record<string, any>;
  errors: Record<string, string>;
  history: string[];
  isLoading: boolean;
  canGoNext: boolean;
  canGoBack: boolean;
}