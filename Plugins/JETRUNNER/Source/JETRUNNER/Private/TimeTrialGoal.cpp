#include "TimeTrialGoal.h"
#include "SBCheckpointComponent.h"

ATimeTrialGoal::ATimeTrialGoal(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer)
    , CheckpointRadius(100.0f)
    , bUnlocked(true)
{
    CheckpointComponent = CreateDefaultSubobject<USBCheckpointComponent>(TEXT("CheckpointComponent"));
}
