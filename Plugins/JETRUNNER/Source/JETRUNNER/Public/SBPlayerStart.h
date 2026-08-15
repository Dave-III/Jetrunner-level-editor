#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerStart.h"
#include "GameplayTagContainer.h"
#include "SBPlayerStart.generated.h"

UCLASS(Blueprintable)
class JETRUNNER_API ASBPlayerStart : public APlayerStart
{
    GENERATED_BODY()

public:
    ASBPlayerStart(const FObjectInitializer& ObjectInitializer);

    /** Authoring helper used by the JSON compiler to serialize genuine tags. */
    UFUNCTION(BlueprintCallable, Category = "JLE|Compiler")
    void SetJLEGameplayTags(FName InGameModeTagName, FName InTeamTagName);

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    FGameplayTag GameModeGameplayTag;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    FGameplayTag TeamGameplayTag;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, meta = (AllowPrivateAccess = true))
    int32 TeamID;
};
