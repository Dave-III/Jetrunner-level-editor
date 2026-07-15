using UnrealBuildTool;
using System.Collections.Generic;

public class JetrunnerMapCompilerTarget : TargetRules
{
    public JetrunnerMapCompilerTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V5;

        ExtraModuleNames.Add("JetrunnerMapCompiler");
    }
}