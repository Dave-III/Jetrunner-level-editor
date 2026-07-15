#include "JetExperienceDefinition.h"

UJetExperienceDefinition::UJetExperienceDefinition() = default;

bool UJetExperienceDefinition::IsPlayable() const
{
    return bIsPlayable;
}

TArray<FMedalTimeCombo> UJetExperienceDefinition::GetMedalTimes() const
{
    return MedalTimes;
}

FName UJetExperienceDefinition::GetActualExperienceId() const
{
    return ExperienceId;
}
