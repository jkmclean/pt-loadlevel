{ pkgs, ... }: {
  channel = "stable-24.05";

  packages = [
    pkgs.nodejs_20
  ];

  idx = {
    extensions = [];

    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npx" "-y" "serve" "." "-l" "3000" "--no-clipboard"];
          manager = "web";
          env = {
            PORT = "$PORT";
          };
        };
      };
    };

    workspace = {
      onCreate = {};
      onStart = {};
    };
  };
}
