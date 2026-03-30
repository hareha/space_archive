import React, { createContext, useContext, useState } from 'react';

interface OnboardingContextType {
    showOnboarding: boolean;
    setShowOnboarding: (v: boolean) => void;
    showOnboardingB: boolean;
    setShowOnboardingB: (v: boolean) => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
    showOnboarding: false,
    setShowOnboarding: () => {},
    showOnboardingB: false,
    setShowOnboardingB: () => {},
});

export const useOnboarding = () => useContext(OnboardingContext);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [showOnboardingB, setShowOnboardingB] = useState(false);

    return (
        <OnboardingContext.Provider value={{ showOnboarding, setShowOnboarding, showOnboardingB, setShowOnboardingB }}>
            {children}
        </OnboardingContext.Provider>
    );
}
