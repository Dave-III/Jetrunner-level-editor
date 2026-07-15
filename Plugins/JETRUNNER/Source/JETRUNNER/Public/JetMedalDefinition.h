#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "JetMedalDefinition.generated.h"

UCLASS(Blueprintable)
class JETRUNNER_API UJetMedalDefinition : public UDataAsset
{
    GENERATED_BODY()

public:
    UJetMedalDefinition();

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FGameplayTag MedalTag;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FText MedalDisplayName;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    UObject* MedalImage = nullptr;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    int32 MedalValueRating = 0;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    bool bIsSecretMedal = false;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, Transient)
    bool bIsBeaten = false;

    UFUNCTION(BlueprintCallable, BlueprintPure)
    bool ShouldRevealMedal() const;
};
