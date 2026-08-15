#include "SBPlayerStart.h"

ASBPlayerStart::ASBPlayerStart(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer)
    , GameModeGameplayTag(FGameplayTag::RequestGameplayTag(FName(TEXT("TimeTrial")), false))
    , TeamID(0)
{
}

void ASBPlayerStart::SetJLEGameplayTags(FName InGameModeTagName, FName InTeamTagName)
{
    GameModeGameplayTag = InGameModeTagName.IsNone()
        ? FGameplayTag()
        : FGameplayTag::RequestGameplayTag(InGameModeTagName, false);
    TeamGameplayTag = InTeamTagName.IsNone()
        ? FGameplayTag()
        : FGameplayTag::RequestGameplayTag(InTeamTagName, false);
}
