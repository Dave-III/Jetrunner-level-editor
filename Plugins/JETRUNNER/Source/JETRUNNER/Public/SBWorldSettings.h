#pragma once

#include "CoreMinimal.h"
#include "GameFramework/WorldSettings.h"
#include "UObject/PrimaryAssetId.h"
#include "SBWorldSettings.generated.h"

class UJetLevelDefinition;
class UJetStoryAsset;
class USBRuleset;

UCLASS(Blueprintable)
class JETRUNNER_API ASBWorldSettings : public AWorldSettings
{
    GENERATED_BODY()

public:
    ASBWorldSettings(const FObjectInitializer& ObjectInitializer);

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    TSoftClassPtr<USBRuleset> DefaultRuleset;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    FPrimaryAssetId MapDisplayData;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    bool bIsMenuWorld = false;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    float EnergyAtStart = 100.0f;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    int32 WorldStartingPolarity = 0;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    UJetStoryAsset* JetStoryAsset = nullptr;

protected:
    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    bool bIsFlashbackWorld = false;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    TSoftObjectPtr<UJetLevelDefinition> LevelDefinition;
};
