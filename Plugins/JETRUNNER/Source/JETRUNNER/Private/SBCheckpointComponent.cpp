#include "SBCheckpointComponent.h"

USBCheckpointComponent::USBCheckpointComponent(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer)
    , bIsActivated(false)
    , bIsLocked(false)
    , TeamID(0)
{
    SetIsReplicatedByDefault(true);
}
