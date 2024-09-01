cd ../Paradise
git commit -a -m "To reset"
git reset --hard HEAD@{1}
git stash apply
