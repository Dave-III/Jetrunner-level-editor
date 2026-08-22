#pragma once
UINTERFACE(BlueprintType) class UResettable : public UInterface {};
class IResettable { public: virtual void Reset() = 0; };
UCLASS(Blueprintable)
class TESTGAME_API ABP_OneMesh : public AActor, public IResettable {
  GENERATED_BODY()
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Placement") float PlacementScale;
  UFUNCTION(BlueprintCallable) void ResetObject(int32 Mode);
};
USTRUCT(BlueprintType) struct FPlacementData { GENERATED_BODY() };
UENUM(BlueprintType) enum class EPlacementKind : uint8 { Static, Gameplay, Decorative };
