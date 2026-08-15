#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "SBRuleset.generated.h"

class UBehaviorTree;
class URulesetActionSet;
class USBBreakWidget;
class USBPawnData;
class USBScoreboardData;
class UUserWidget;

UCLASS(Abstract, Blueprintable, Const)
class JETRUNNER_API USBRuleset : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    USBRuleset();

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    FName DevName;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    TSoftObjectPtr<USBPawnData> PawnData;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    TSoftObjectPtr<USBPawnData> PawnDataSpectator;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    FGameplayTag GameModeGameplayTag;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    FPrimaryAssetId RulesetDisplayData;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    FText DisplayName;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    TSoftClassPtr<UUserWidget> InfoWidget;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    TSoftClassPtr<USBScoreboardData> ScoreboardData;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    TSoftClassPtr<USBBreakWidget> BreakScreenWidget;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    TSoftClassPtr<UUserWidget> GameRecapWidget;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    TSoftClassPtr<UUserWidget> LoadoutScreen;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    TSoftObjectPtr<UBehaviorTree> BehaviorTreeOverride;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    TArray<URulesetActionSet*> ActionSets;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, Instanced, meta = (AllowPrivateAccess = true))
    TArray<UObject*> Actions;
};
