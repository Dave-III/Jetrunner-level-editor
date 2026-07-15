#pragma once

#include "CoreMinimal.h"
#include "JetExperienceDefinition.h"
#include "JetMedalDefinition.h"
#include "JetLevelDefinition.generated.h"

class UJetMedalDefinition;
class UJetStoryAsset;
class UWorld;

UCLASS(Blueprintable)
class JETRUNNER_API UJetLevelDefinition : public UJetExperienceDefinition
{
    GENERATED_BODY()

public:
    UJetLevelDefinition();

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FName LevelId;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FText LevelDescription;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    TSoftObjectPtr<UWorld> MapAssetPtr;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FSoftObjectPath MapAsset;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    TMap<float, UJetMedalDefinition*> MedalMap;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    bool bIsBonusLevel = false;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    bool bHasArcadeToken = false;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, Transient)
    bool bArcadeTokenCollected = false;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, Transient)
    bool bLevelLocked = false;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    TSoftObjectPtr<UJetStoryAsset> StoryAsset;
};
