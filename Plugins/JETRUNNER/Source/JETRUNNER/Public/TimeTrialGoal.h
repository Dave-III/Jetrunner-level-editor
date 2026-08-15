#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TimeTrialGoal.generated.h"

class USBCheckpointComponent;

UCLASS(Blueprintable)
class JETRUNNER_API ATimeTrialGoal : public AActor
{
    GENERATED_BODY()

public:
    ATimeTrialGoal(const FObjectInitializer& ObjectInitializer);

protected:
    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta=(AllowPrivateAccess=true))
    float CheckpointRadius;

private:
    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta=(AllowPrivateAccess=true))
    bool bUnlocked;

    UPROPERTY(VisibleAnywhere, Instanced, meta=(AllowPrivateAccess=true))
    USBCheckpointComponent* CheckpointComponent;
};
