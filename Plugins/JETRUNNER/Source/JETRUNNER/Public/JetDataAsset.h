#pragma once

#include "CoreMinimal.h"
#include "Engine/PrimaryDataAsset.h"
#include "GameplayTagContainer.h"
#include "JetDataAsset.generated.h"

UCLASS(Abstract, Blueprintable)
class JETRUNNER_API UJetDataAsset : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    UJetDataAsset();

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FGameplayTag AssetTag;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FGameplayTagContainer AssetTags;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FText DisplayName;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FText Description;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    UObject* Icon = nullptr;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    UObject* Image = nullptr;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FGameplayTagContainer UnlockTags;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FGameplayTag UnlockCeremonyTag;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, Transient)
    bool bIsUnlocked = false;
};
