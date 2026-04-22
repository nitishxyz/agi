import { Box } from "../primitives/box";
import { Button } from "../primitives/button";
import { Text } from "../primitives/text";
import type { StepProps } from "./types";

export const TestStep: React.FC<StepProps> = ({
  data,
  updateData,
  goNext,
  goBack,
  isLoading,
  errors,
  stepIndex,
  totalSteps,
}) => {
  return (
    <Box gap="lg" p="md">
      <Box center>
        <Text size="lg" weight="semibold">
          Test Step {stepIndex + 1} of {totalSteps}
        </Text>
        <Text size="sm" style={{ opacity: 0.6, marginTop: 4 }}>
          {stepIndex === 0 && "First step - try going Next"}
          {stepIndex === 1 && "Middle step - try Back and Next"}
          {stepIndex === 2 && "Final step - try Back or Complete"}
        </Text>
      </Box>
      
      <Box gap="sm">
        <Text>Current data:</Text>
        <Text size="sm" style={{ opacity: 0.7 }}>
          {JSON.stringify(data, null, 2)}
        </Text>
      </Box>

      {errors && Object.keys(errors).length > 0 && (
        <Box gap="xs">
          <Text>Errors:</Text>
          {Object.entries(errors).map(([key, error]) => (
            <Text key={key} size="sm" style={{ color: 'red' }}>
              {key}: {error}
            </Text>
          ))}
        </Box>
      )}

      <Box direction="row" gap="sm" alignItems="center">
        {stepIndex > 0 && (
          <Box flex>
            <Button
              variant="outline"
              onPress={goBack}
              disabled={isLoading}
            >
              <Button.Text>Back</Button.Text>
            </Button>
          </Box>
        )}
        
        <Box flex>
          <Button
            onPress={() => {
              updateData({ [`step${stepIndex + 1}`]: `completed` });
              goNext();
            }}
            disabled={isLoading}
          >
            <Button.Text>
              {stepIndex === totalSteps - 1 ? 'Complete' : 'Next'}
            </Button.Text>
          </Button>
        </Box>
      </Box>

      {isLoading && (
        <Box center p="md">
          <Text>Loading...</Text>
        </Box>
      )}
    </Box>
  );
};