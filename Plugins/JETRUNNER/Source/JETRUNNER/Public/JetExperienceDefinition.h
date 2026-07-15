#pragma once

#include "CoreMinimal.h"
#include "JetDataAsset.h"
#include "MedalTimeCombo.h"
#include "JetExperienceDefinition.generated.h"

UCLASS(Blueprintable)
class JETRUNNER_API UJetExperienceDefinition : public UJetDataAsset
{
    GENERATED_BODY()

public:
    UJetExperienceDefinition();

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FName ExperienceId;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FText ExperienceName;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FText ExperienceDescription;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    UObject* CoverImage = nullptr;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    TArray<FMedalTimeCombo> MedalTimes;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    bool bIsPlayable = false;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    FGameplayTag MusicTag;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, Transient)
    float BestTime = 0.0f;

    UFUNCTION(BlueprintCallable, BlueprintPure)
    bool IsPlayable() const;

    UFUNCTION(BlueprintCallable, BlueprintPure)
    TArray<FMedalTimeCombo> GetMedalTimes() const;

    UFUNCTION(BlueprintCallable, BlueprintPure)
    FName GetActualExperienceId() const;
};
