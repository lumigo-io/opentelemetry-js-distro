echo "Creating new credential files"
enc_location=../common-resources/encrypted_files/credentials_production.enc
if [[ ! -f ${enc_location} ]]
then
    echo "$enc_location not found"
    exit 1
fi

mkdir -p ~/.aws
echo "${KEY}" | gpg --batch -d --passphrase-fd 0 ${enc_location} > ~/.aws/credentials
./scripts/deploy.sh --env prod