package com.comfy.library.repository;

import com.comfy.library.entity.LoraCategory;
import com.comfy.library.entity.LoraEntity;
import org.hibernate.query.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.awt.print.Pageable;
import java.util.List;
import java.util.Optional;

@Repository
public interface LoraRepository extends JpaRepository<LoraEntity, Long> {

    List<LoraEntity> findByLoraNameContainingIgnoreCase(String keyword);

    List<LoraEntity> findByCategory(LoraCategory category);

    List<LoraEntity> findByGroupNameIgnoreCase(String groupName);

    List<LoraEntity> findByFavoriteTrue();

    List<LoraEntity> findAllByOrderByGroupNameAsc();

    Optional<LoraEntity> findBySha256(String sha256);

    boolean existsBySha256(String sha256);

}