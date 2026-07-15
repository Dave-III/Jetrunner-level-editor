#include "SBWorldSettings.h"

ASBWorldSettings::ASBWorldSettings(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer)
    , bIsMenuWorld(false)
    , EnergyAtStart(0.0f)
    , WorldStartingPolarity(0)
    , JetStoryAsset(nullptr)
    , bIsFlashbackWorld(false)
{
}
