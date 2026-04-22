import React, { useRef } from "react";
import { Box } from "../primitives/box";
import { Button } from "../primitives/button";
import { Text } from "../primitives";
import GorhomSheetNavigator, { type GorhomSheetNavigatorRef } from "./gorhom-sheet-navigator";
import { TestStep } from "./test-step";

const GorhomSheetNavigatorTest: React.FC = () => {
  const sheetRef = useRef<GorhomSheetNavigatorRef>(null);

  // Test steps for the GorhomSheetNavigator
  const testSteps = [
    {
      id: "step1",
      title: "First Step",
      component: TestStep,
      validation: (data: any) => {
        // Simple validation example
        return data.step1 ? true : "Please complete step 1";
      },
    },
    {
      id: "step2", 
      title: "Second Step",
      component: TestStep,
      validation: (data: any) => {
        return data.step2 ? true : "Please complete step 2";
      },
    },
    {
      id: "step3",
      title: "Final Step", 
      component: TestStep,
      validation: (data: any) => {
        return data.step3 ? true : "Please complete step 3";
      },
    },
  ];

  const handleOpenSheet = () => {
    sheetRef.current?.present();
  };

  const handleCloseSheet = () => {
    console.log("Sheet closed");
  };

  const handleCompleteFlow = async (data: any) => {
    console.log("🎉 Flow completed with data:", data);
    
    // Simulate some async completion work
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // The sheet will auto-close after completion (handled in component)
    console.log("✅ Completion processed successfully");
  };

  return (
    <Box gap="md" p="lg">
      <Box center>
        <Box mb="sm">
          <Text size="xl" weight="bold">
            GorhomSheetNavigator Test
          </Text>
        </Box>
        <Box mb="lg">
          <Text size="sm" style={{ opacity: 0.7, textAlign: 'center' }}>
            This tests the new Gorhom-based sheet navigator with:
            {'\n'}• Native bottom sheet animations
            {'\n'}• Step transitions with slide effects
            {'\n'}• Progress indicator dots
            {'\n'}• Backdrop tap-to-close
            {'\n'}• Pan-to-dismiss gestures
          </Text>
        </Box>
      </Box>

      <Button onPress={handleOpenSheet}>
        <Button.Text>Open GorhomSheetNavigator</Button.Text>
      </Button>

      <Box mt="md">
        <Box mb="xs">
          <Text size="sm" weight="semibold">Test Features:</Text>
        </Box>
        <Text size="xs" style={{ opacity: 0.6 }}>
          • Try tapping backdrop to close{'\n'}
          • Try swiping down to dismiss{'\n'}
          • Navigate between steps with smooth animations{'\n'}
          • Watch progress dots update{'\n'}
          • Complete the flow to see async handling
        </Text>
      </Box>

      <GorhomSheetNavigator
        ref={sheetRef}
        visible={false} // Not used - controlled via ref
        onClose={handleCloseSheet}
        steps={testSteps}
        onComplete={handleCompleteFlow}
        initialData={{}}
        showProgress={true}
        title="Test Flow"
      />
    </Box>
  );
};

export default GorhomSheetNavigatorTest;