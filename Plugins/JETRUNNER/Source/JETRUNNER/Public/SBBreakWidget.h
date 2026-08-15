#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "SBBreakWidget.generated.h"

UCLASS(Abstract, Blueprintable, EditInlineNew)
class JETRUNNER_API USBBreakWidget : public UUserWidget
{
    GENERATED_BODY()
public:
    USBBreakWidget(const FObjectInitializer& ObjectInitializer);
};
