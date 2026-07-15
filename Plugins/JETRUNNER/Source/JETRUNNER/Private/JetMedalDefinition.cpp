#include "JetMedalDefinition.h"

UJetMedalDefinition::UJetMedalDefinition() = default;

bool UJetMedalDefinition::ShouldRevealMedal() const
{
    return !bIsSecretMedal || bIsBeaten;
}
