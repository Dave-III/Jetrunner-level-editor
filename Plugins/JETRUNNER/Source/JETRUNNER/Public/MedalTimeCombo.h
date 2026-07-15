#pragma once

#include "CoreMinimal.h"
#include "MedalTimeCombo.generated.h"

class UJetMedalDefinition;

USTRUCT(BlueprintType)
struct JETRUNNER_API FMedalTimeCombo
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    bool bAnyTime = false;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    float Time = 0.0f;

    UPROPERTY(BlueprintReadWrite, EditAnywhere)
    UJetMedalDefinition* Medal = nullptr;
};
