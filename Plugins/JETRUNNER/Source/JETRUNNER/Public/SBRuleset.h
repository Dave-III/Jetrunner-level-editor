#pragma once

#include "CoreMinimal.h"
#include "Engine/PrimaryDataAsset.h"
#include "GameplayTagContainer.h"
#include "SBRuleset.generated.h"

UCLASS(Abstract, Blueprintable, Const)
class JETRUNNER_API USBRuleset : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    USBRuleset();

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    FName DevName;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    FGameplayTag GameModeGameplayTag;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    FPrimaryAssetId RulesetDisplayData;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    FText DisplayName;
};
