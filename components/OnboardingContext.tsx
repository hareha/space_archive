import React, { createContext, useContext, useState } from 'react';

interface OnboardingContextType {
    showOnboarding: boolean;
    setShowOnboarding: (v: boolean) => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
    showOnboarding: false,
    setShowOnboarding: () => {},
});

export const useOnboarding = () => useContext(OnboardingContext);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
    const [showOnboarding, setShowOnboarding] = useState(false);

    return (
        <OnboardingContext.Provider value={{ showOnboarding, setShowOnboarding }}>
            {children}
        </OnboardingContext.Provider>
    );
}
