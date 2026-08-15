#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "RulesetActionSet.generated.h"

UCLASS(Blueprintable)
class JETRUNNER_API URulesetActionSet : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    URulesetActionSet();

    UPROPERTY(BlueprintReadWrite, EditAnywhere, Instanced, meta = (AllowPrivateAccess = true))
    TArray<UObject*> Actions;
};
